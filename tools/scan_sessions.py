import glob, os, json, sys, datetime
sys.stdout.reconfigure(encoding='utf-8')

all_jsonls = glob.glob(r'C:\Users\takep\.claude\projects\**\*.jsonl', recursive=True)
main_sessions = [f for f in all_jsonls if 'subagents' not in f]

print(f'Total session files across entire system: {len(main_sessions)} (plus {len(all_jsonls) - len(main_sessions)} subagent files)')

by_project = {}
for f in main_sessions:
    proj_dir = os.path.basename(os.path.dirname(f))
    by_project.setdefault(proj_dir, []).append(f)

for proj, files in sorted(by_project.items()):
    files.sort(key=os.path.getmtime, reverse=True)
    total_sz = sum(os.path.getsize(x) for x in files) / (1024*1024)
    print(f'\n📁 {proj} ({len(files)} sessions, {total_sz:.2f} MB):')
    for f in files[:4]:
        dt = datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M')
        sz_kb = os.path.getsize(f) / 1024
        first_user = ''
        turn_count = 0
        try:
            with open(f, 'r', encoding='utf-8', errors='ignore') as jf:
                for line in jf:
                    if '"type": "user"' in line or '"type":"user"' in line:
                        turn_count += 1
                        if not first_user:
                            try:
                                d = json.loads(line)
                                msg = d.get('message', {})
                                content = msg.get('content', '') if isinstance(msg, dict) else str(msg)
                                if isinstance(content, list):
                                    t = ' '.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
                                    if t: first_user = t[:120].replace('\n', ' ')
                                elif isinstance(content, str):
                                    first_user = content[:120].replace('\n', ' ')
                            except:
                                pass
        except Exception:
            pass
        print(f'   - [{dt}] ({sz_kb:.0f} KB, {turn_count} user turns) {os.path.basename(f)}')
        if first_user:
            print(f'     Тема: {first_user}')
    if len(files) > 4:
        print(f'     ... и ещё {len(files) - 4} более старых сессий')
