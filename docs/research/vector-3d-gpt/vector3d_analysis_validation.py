"""Numerical sanity checks used in VECTOR_TOOLS_3D_RESEARCH_RESULTS.md."""
import math
import numpy as np

def sphere_flux(ntheta, nphi):
    th=(np.arange(ntheta)+.5)*math.pi/ntheta
    ph=(np.arange(nphi)+.5)*2*math.pi/nphi
    T,_=np.meshgrid(th,ph,indexing='ij')
    # F=r/r^3 on unit sphere => F.n=1; dS=sin(theta)dtheta dphi
    return float(np.sum(np.sin(T))*(math.pi/ntheta)*(2*math.pi/nphi))

def circle_line_integral(n):
    t=np.arange(n)*2*math.pi/n
    p=np.c_[np.cos(t),np.sin(t),np.zeros(n)]
    q=np.roll(p,-1,axis=0); m=(p+q)/2
    f=np.c_[-m[:,1],m[:,0],np.zeros(n)]
    return float(np.sum(f*(q-p)))

if __name__=='__main__':
    print('Flux of r/r^3 through unit sphere; exact 4pi =',4*math.pi)
    for a,b in [(8,16),(16,32),(32,64),(64,128)]:
        v=sphere_flux(a,b); print(a,b,v,'relative error',abs(v-4*math.pi)/(4*math.pi))
    print('\nLine integral of (-y,x,0) around unit circle; exact 2pi =',2*math.pi)
    for n in [16,32,64,128,256]:
        v=circle_line_integral(n); print(n,v,'relative error',abs(v-2*math.pi)/(2*math.pi))
