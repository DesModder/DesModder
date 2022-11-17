import self from "globals/workerSelf";
import { compileGLesmos } from "plugins/GLesmos/exportAsGLesmos";

(self as any).dsm_compileGLesmos = compileGLesmos as any;
