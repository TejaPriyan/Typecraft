import os, sys
files=['00_core','10_audio','20_glyphs','30_shaders','40_scene','50_letters','60_physics','70_particles','80_input','85_motion','90_timeline','95_export','97_storage','98_ui','99_main','99_end']
base_dir = os.path.dirname(os.path.abspath(__file__))
js = '\n'.join(open(os.path.join(base_dir, f'js/{f}.js'), encoding='utf-8').read() for f in files)
head = open(os.path.join(base_dir, 'head.html'), encoding='utf-8').read()
out = head + js + '\n</script>\n</body>\n</html>\n'
out_path = os.path.join(base_dir, '../index.html')
open(out_path, 'w', encoding='utf-8').write(out)
print(f'Successfully built index.html: {len(out)//1024} KB, {out.count(chr(10))} lines')
