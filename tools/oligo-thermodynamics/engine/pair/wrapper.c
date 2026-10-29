/* SPDX-License-Identifier: GPL-2.0-or-later
 * Phase3R adapter ABI1. Upstream THAL/parameters unchanged.
 * dna_conc is the explicit Primer3 API reference parameter in nM.
 */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "thal.h"
#include "thal_parameters.h"

static char input_a[128], input_b[128], drawing[8192], message[255];
static double values[7];
static int initialized = 0;
int abi_version(void) { return 1; }
int input_capacity(void) { return 128; }
char *input_a_ptr(void) { return input_a; }
char *input_b_ptr(void) { return input_b; }
char *drawing_ptr(void) { return drawing; }
char *message_ptr(void) { return message; }
double *values_ptr(void) { return values; }

static int valid_sequence(const char *s) {
  size_t n = 0;
  while (n < sizeof(input_a) && s[n]) ++n;
  return n >= 2 && n <= 60 && strspn(s,"ACGT") == n;
}

int run_raw(int mode,double tc,double mv,double dv,double dntp,double conc,int show) {
  thal_results r = {0};
  for (int i=0;i<7;++i) values[i] = NAN;
  memset(drawing,0,sizeof(drawing)); memset(message,0,sizeof(message));
  if (mode < 1 || mode > 4 || !valid_sequence(input_a) || !valid_sequence(input_b) ||
      (mode == 4 && strcmp(input_a,input_b)) || (show != 0 && show != 1) ||
      !isfinite(tc) || tc < 0 || tc > 100 || !isfinite(mv) || mv < 0 ||
      !isfinite(dv) || dv < 0 || !isfinite(dntp) || dntp < 0 ||
      !isfinite(conc) || conc <= 0 || (mv == 0 && dv <= dntp)) {
    strcpy(message,"Unsupported input or reference condition"); return -1;
  }
  if (!initialized) {
    thal_parameters p = {0};
    if (set_default_thal_parameters(&p) || get_thermodynamic_values(&p,&r)) {
      snprintf(message,sizeof(message),"%s",r.msg); thal_free_parameters(&p); return -2;
    }
    thal_free_parameters(&p); initialized = 1;
  }
  thal_args a; set_thal_default_args(&a);
  a.type = (thal_alignment_type)mode; a.dimer = mode != 4; a.maxLoop = 30;
  a.mv = mv; a.dv = dv; a.dntp = dntp; a.dna_conc = conc; a.temp = tc + 273.15;
  r.sec_struct = drawing;
  thal((unsigned char *)input_a,(unsigned char *)input_b,&a,THL_GENERAL,&r,0);
  if (show && !r.no_structure && r.temp != THAL_ERROR_SCORE && !r.msg[0])
    thal((unsigned char *)input_a,(unsigned char *)input_b,&a,THL_GENERAL,&r,1);
  snprintf(message,sizeof(message),"%s",r.msg);
  if (r.temp == THAL_ERROR_SCORE || r.msg[0]) return -3;
  values[4] = r.no_structure;
  if (r.no_structure) return 0;
  if (!isfinite(r.temp) || !isfinite(r.dg) || !isfinite(r.dh) || !isfinite(r.ds)) {
    strcpy(message,"Nonfinite THAL result"); return -4;
  }
  values[0] = r.temp; values[1] = r.dg/1000.; values[2] = r.dh/1000.; values[3] = r.ds;
  if (mode != 4) { values[5] = r.align_end_1; values[6] = r.align_end_2; }
  return 1;
}

#ifdef NATIVE_MAIN
static int read_number(const char *s,double *out) {
  char *end; *out = strtod(s,&end); return *s && !*end && isfinite(*out);
}
int main(int argc,char **argv) {
  if (argc != 11) return 2;
  if (strlen(argv[2]) >= sizeof(input_a) || strlen(argv[3]) >= sizeof(input_b)) return 2;
  strcpy(input_a,argv[2]); strcpy(input_b,argv[3]);
  double n[7];
  if (!read_number(argv[1],&n[0]) || !read_number(argv[9],&n[6])) return 2;
  for (int i=0;i<5;++i) if (!read_number(argv[4+i],&n[i+1])) return 2;
  if (n[0] < 1 || n[0] > 4 || n[6] < 0 || n[6] > 1 ||
      n[0] != (int)n[0] || n[6] != (int)n[6]) return 2;
  int status = run_raw((int)n[0],n[1],n[2],n[3],n[4],n[5],(int)n[6]);
  /* argv10 is a protocol token, checked to catch accidental CLI shape changes. */
  if (strcmp(argv[10],"abi1")) return 2;
  printf("%d %.17g %.17g %.17g %.17g %.17g %.17g %.17g\n%s\n%s",status,
    values[0],values[1],values[2],values[3],values[4],values[5],values[6],message,drawing);
  if (initialized) destroy_thal_structures();
  return status < 0 ? 3 : 0;
}
#endif
