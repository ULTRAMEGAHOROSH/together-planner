# Деплой на Oracle Cloud (Always Free)

Одна виртуальная машина, на ней `docker compose`: Caddy (HTTPS) → nginx с Angular → backend → Postgres.
Наружу открыты только порты 80 и 443. Файлы: `docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/.env.prod.example`.

## 1. Аккаунт Oracle Cloud
1. https://www.oracle.com/cloud/free/ → **Start for free**.
2. Нужна банковская карта для проверки (деньги не списываются, при Always Free ресурсах счёт нулевой).
3. **Home region выбирайте внимательно** — его нельзя поменять. Лучше регион, где есть свободные ARM-машины (Frankfurt, Amsterdam, Stockholm бывают заняты — тогда попробуйте позже или другой регион).

## 2. Создать виртуальную машину
Консоль → **Compute → Instances → Create instance**:
- **Image:** Canonical Ubuntu 24.04 (или 22.04).
- **Shape:** Change shape → **Ampere** → `VM.Standard.A1.Flex`, 2 OCPU и 12 GB памяти (в лимит Always Free входят до 4 OCPU и 24 GB). Если ARM недоступен («Out of capacity») — `VM.Standard.E2.1.Micro` (1 GB), но Java там будет тесно: нужен swap (см. п. 8).
- **Networking:** публичная подсеть, **Assign a public IPv4 address**.
- **SSH keys:** Generate a key pair → скачайте приватный ключ (`.key`) и храните его; без него на машину не попасть.
- Boot volume: 50–100 GB.

После создания скопируйте **Public IP** (дальше `A.B.C.D`).

## 3. Открыть порты 80 и 443
Два места, и нужны оба.

**а) Облачный файрвол (Security List).** Instance → Primary VNIC → Subnet → Security Lists → Default → **Add Ingress Rules**:
| Source CIDR | Protocol | Dest. port |
|---|---|---|
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

(22 для SSH уже открыт. Порты 5432 и 8080 наружу не открывайте.)

**б) Файрвол самой Ubuntu** (в образах Oracle по умолчанию стоят правила iptables, режущие 80/443) — см. п. 4.

## 4. Подключиться и установить Docker
В PowerShell на своём компьютере:
```powershell
ssh -i C:\путь\к\ключу.key ubuntu@A.B.C.D
```
На сервере:
```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker

# открыть 80/443 в iptables Ubuntu и сохранить
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save
```

## 5. Забрать проект
```bash
git clone https://github.com/ULTRAMEGAHOROSH/together-planner.git
cd together-planner
```
Если репозиторий приватный, git попросит логин и **Personal Access Token** (GitHub → Settings → Developer settings → Tokens, право `repo`/Contents: read) вместо пароля.

> Структура репозитория: корень репозитория — это содержимое папки `together-planner` (там лежат `backend/`, `frontend/`, `docker-compose.prod.yml`). Если после клонирования они лежат на уровень глубже — `cd` в папку, где есть `docker-compose.prod.yml`.

## 6. Настроить окружение
```bash
cp deploy/.env.prod.example .env
nano .env
```
Заполните:
- `DOMAIN` — бесплатное имя без регистрации: `A.B.C.D.sslip.io` (например `129.80.1.2.sslip.io`; sslip.io сам резолвит его в этот IP). Для своего домена — создайте A-запись на IP и впишите его.
- `POSTGRES_PASSWORD` — `openssl rand -base64 24`
- `JWT_SECRET` — `openssl rand -base64 48`

Не используйте в значениях `#` и пробелы.

## 7. Запустить
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend   # ждём "Started ...Application"
```
Первая сборка на ARM занимает 5–10 минут. Затем откройте `https://A.B.C.D.sslip.io` — Caddy сам получит сертификат Let's Encrypt (это занимает до минуты; пока не получил — проверьте, что порты 80/443 открыты в обоих файрволах).
Эту ссылку и можно отправлять людям.

## 8. Если памяти мало (1 GB машина) — swap
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Эксплуатация
```bash
docker compose -f docker-compose.prod.yml ps              # состояние
docker compose -f docker-compose.prod.yml logs -f caddy   # проблемы с сертификатом
git pull && docker compose -f docker-compose.prod.yml up -d --build   # обновление версии

# резервная копия БД
docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```
Контейнеры с `restart: unless-stopped` поднимутся сами после перезагрузки машины.

## Важно
- Oracle удаляет **простаивающие** Always Free машины (низкая загрузка CPU/сети в течение 7 дней). Чтобы этого избежать, можно перевести аккаунт в Pay As You Go: при использовании только Always Free ресурсов оплата остаётся нулевой, а риск удаления пропадает.
- Данные Postgres лежат в docker-volume `pgdata` на диске ВМ. Делайте дампы (команда выше).
- Swagger в проде выключен (`SWAGGER_ENABLED=false`).
- Лимит запросов nginx на вход (20 в минуту с адреса) считается по реальному адресу клиента: nginx читает его из `X-Forwarded-For` от Caddy.
