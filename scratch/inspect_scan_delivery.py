with open('backend/src/main/java/vn/rikkei/post/service/impl/ShipperServiceImpl.java', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'scanOutForDelivery' in line:
        for j in range(i, min(i+50, len(lines))):
            print(f'{j+1}: {lines[j].strip()}')
        break
