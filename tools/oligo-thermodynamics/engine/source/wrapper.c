/* JSU local candidate wrapper, GPL-2.0-or-later. Upstream files unchanged. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "thal.h"
#include "thal_parameters.h"
static char input[128], structure[8192], message[255];
static double output[5];
static int initialized=0;
char *input_ptr(void){return input;}
double *output_ptr(void){return output;}
char *structure_ptr(void){return structure;}
char *message_ptr(void){return message;}
int hp(double tc,double mv,double dv,double dntp,double conc,int show){
  thal_results r={0};
  memset(output,0,sizeof(output));memset(structure,0,sizeof(structure));memset(message,0,sizeof(message));
  size_t n=strlen(input);
  if(n<2||n>60||strspn(input,"ACGT")!=n||!isfinite(tc)||tc<=-273.15||!isfinite(mv)||mv<0||!isfinite(dv)||dv<0||!isfinite(dntp)||dntp<0||!isfinite(conc)||conc<=0||(mv==0&&dv<=dntp)){strcpy(message,"Unsupported input");return -1;}
  if(!initialized){
    thal_parameters p={0};
    if(set_default_thal_parameters(&p)||get_thermodynamic_values(&p,&r)){snprintf(message,sizeof(message),"%s",r.msg);thal_free_parameters(&p);return -2;}
    thal_free_parameters(&p);initialized=1;
  }
  thal_args a;set_thal_default_args(&a);a.type=thal_hairpin;a.maxLoop=30;a.mv=mv;a.dv=dv;a.dntp=dntp;a.dna_conc=conc;a.temp=tc+273.15;
  r.sec_struct=structure;
  /* Match primer3-py's default evaluation mode THL_GENERAL. THL_STRUCT
   * is a distinct mode, not the output_structure toggle. It can leave
   * no_structure unset for missing structures. A preallocated buffer and
   * print_output toggle give GENERAL results with optional drawing.
   */
  thal((unsigned char*)input,(unsigned char*)input,&a,THL_GENERAL,&r,0);
  /* Do not invoke the no-structure drawing path, which writes to stderr. */
  if(show&&!r.no_structure&&r.temp!=THAL_ERROR_SCORE&&!r.msg[0]){
    thal((unsigned char*)input,(unsigned char*)input,&a,THL_GENERAL,&r,1);
  }
  snprintf(message,sizeof(message),"%s",r.msg);
  output[0]=r.temp;output[1]=r.dg/1000.0;output[2]=r.dh/1000.0;output[3]=r.ds;output[4]=r.no_structure;
  if(r.temp==THAL_ERROR_SCORE||r.msg[0])return -3;
  if(!r.no_structure&&(!isfinite(r.temp)||!isfinite(r.dg)||!isfinite(r.dh)||!isfinite(r.ds)))return -4;
  return r.no_structure?0:1;
}
#ifdef NATIVE_MAIN
int main(int argc,char **argv){
  if(argc!=8)return 2;snprintf(input,sizeof(input),"%s",argv[1]);
  int status=hp(atof(argv[2]),atof(argv[3]),atof(argv[4]),atof(argv[5]),atof(argv[6]),atoi(argv[7]));
  printf("%d %.17g %.17g %.17g %.17g %.17g\n%s\n%s",status,output[0],output[1],output[2],output[3],output[4],message,structure);
  destroy_thal_structures();return 0;
}
#endif
