from pathlib import Path
import subprocess
p=Path(__file__).parent
assets=Path('/root/.cloudcli/assets')
def run(*args): subprocess.run(['convert',*map(str,args)],check=True)
run(p/'background.png','-resize','2240x747!',p/'banner.png')
centers=[185,500,810,1120,1415,1710,2040]
heights=[545,455,535,370,420,390,520]
for n,(cx,h) in enumerate(zip(centers,heights),1):
 src=next(assets.glob(f'1791038822*-{n}.png'))
 out=p/f'device-{n}.png'
 run(src,'-trim','+repage','-resize',f'x{h}',out)
 if n==3:
  run(out,'(', '+clone','-alpha','extract','-morphology','Erode','Disk:1',')','-alpha','off','-compose','CopyOpacity','-composite',out)
 w=int(subprocess.check_output(['identify','-format','%w',str(out)]))
 shadow=p/f'shadow-{n}.png'
 run('-size','2240x747','xc:none','-fill','rgba(48,42,31,0.23)','-draw',f'ellipse {cx},711 {w*.46},11 0,360','-blur','0x9',shadow)
 run(p/'banner.png',shadow,'-compose','Over','-composite',p/'banner.png')
 run(p/'banner.png',out,'-geometry',f'+{round(cx-w/2)}+{705-h}','-compose','Over','-composite',p/'banner.png')
run(p/'banner.png','-quality','95',p/'peri-equipment-2240x747.jpg')
