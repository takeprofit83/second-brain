import glob, os, json, sys, datetime
sys.stdout.reconfigure(encoding='utf-8')

all_jsonls = glob.glob(r'C:\Users\takep\.claude\projects\**\*.jsonl', recursive=True)
main_sessions = [f for f in all_jsonls if 'subagents' not in f]
main_sessions.sort(key=os.path.getmtime, reverse=True)

by_project = {}
for f in main_sessions:
    proj_dir = os.path.basename(os.path.dirname(f))
    by_project.setdefault(proj_dir, []).append(f)

out_path = r'D:\YandexDisk\Atlas\second-brain\Knowledge\claude_sessions_archive_catalog.md'
os.makedirs(os.path.dirname(out_path), exist_ok=True)

with open(out_path, 'w', encoding='utf-8') as out:
    out.write('---\n')
    out.write('type: knowledge\n')
    out.write('tier: 2\n')
    out.write('ai_read: on_demand\n')
    out.write('tags: [archive, catalog, claude_sessions, knowledge]\n')
    out.write('title: Реестр всех архивных сессий Claude (96 сессий, 1.3 ГБ)\n')
    out.write('---\n\n')
    out.write('# 🏛 Мастер-Реестр всех сохранённых сессий Claude Code / Desktop\n\n')
    out.write('> [!info] **Физическое расположение архива на диске:** `C:\\Users\\takep\\.claude\\projects\\`  \n')
    out.write(f'> Всего в архиве найдено **{len(main_sessions)} основных сессий** (плюс 164 лога сабагентов) общим объёмом **1.3+ ГБ** чистого диалогового контекста и кода.\n')
    out.write('> **Ни одна сессия не удалена** при блокировке аккаунта Anthropic.\n\n')
    out.write('---\n\n')
    
    for proj, files in sorted(by_project.items()):
        files.sort(key=os.path.getmtime, reverse=True)
        total_sz = sum(os.path.getsize(x) for x in files) / (1024*1024)
        out.write(f'## 📁 {proj} ({len(files)} сессий, {total_sz:.2f} МБ)\n\n')
        out.write('| Дата | Размер | Сообщений | Тема / Исходный запрос | Файл на диске |\n')
        out.write('|---|---|:---:|---|---|\n')
        
        for f in files:
            dt = datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M')
            sz_kb = os.path.getsize(f) / 1024
            sz_str = f'{sz_kb:.0f} КБ' if sz_kb < 1024 else f'{sz_kb/1024:.1f} МБ'
            first_user = 'Без темы'
            turn_count = 0
            try:
                with open(f, 'r', encoding='utf-8', errors='ignore') as jf:
                    for line in jf:
                        if '"type": "user"' in line or '"type":"user"' in line:
                            turn_count += 1
                            if first_user == 'Без темы':
                                try:
                                    d = json.loads(line)
                                    msg = d.get('message', {})
                                    content = msg.get('content', '') if isinstance(msg, dict) else str(msg)
                                    if isinstance(content, list):
                                        t = ' '.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
                                        if t: first_user = t[:110].replace('\n', ' ').replace('|', '/')
                                    elif isinstance(content, str):
                                        first_user = content[:110].replace('\n', ' ').replace('|', '/')
                                except Exception:
                                    pass
            except Exception:
                pass
            
            bname = os.path.basename(f)
            out.write(f'| {dt} | {sz_str} | {turn_count} | {first_user} | `{bname}` |\n')
        out.write('\n---\n\n')

print('Catalog written successfully, size:', os.path.getsize(out_path))
