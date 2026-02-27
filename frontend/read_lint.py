import json
with open('lint.json', 'r', encoding='utf-16le') as f:
  data = json.load(f)
for item in data:
  for msg in item.get('messages', []):
    if msg.get('severity') == 2:
      print(f"{item['filePath']}: {msg['message']} (Line {msg['line']})")
