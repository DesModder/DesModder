import { compileGLesmos } from "plugins/GLesmos/exportAsGLesmos";
import self from "globals/workerSelf";

(self as any).dsm_compileGLesmos = compileGLesmos as any;
