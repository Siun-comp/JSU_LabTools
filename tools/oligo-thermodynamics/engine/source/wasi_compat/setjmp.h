/* GPL-2.0-or-later. WASM-only error boundary: discard failed Worker instance.
 * Numerical/structure paths are unchanged. No recovery after THAL longjmp.
 * Native validation uses its platform's real setjmp/longjmp.
 */
#ifndef JSU_WASM_SETJMP_H
#define JSU_WASM_SETJMP_H
typedef int jmp_buf[1];
#define setjmp(buffer) 0
__attribute__((noreturn)) static inline void longjmp(jmp_buf buffer,int value){
  (void)buffer;(void)value;__builtin_trap();
}
#endif
