#!/usr/bin/env bash
# Установка ReQuest на чистый сервер Ubuntu 22.04/24.04.
# Запуск (из веб-консоли сервера, под root):
#   curl -fsSL https://raw.githubusercontent.com/makaba-oss/request/main/scripts/install.sh | bash
set -euo pipefail

REPO="${REPO:-https://github.com/makaba-oss/request.git}"
DIR="${DIR:-/opt/request}"
ask() { local q="$1" def="${2:-}" a; if [ -n "$def" ]; then read -r -p "$q [$def]: " a </dev/tty; echo "${a:-$def}"; else read -r -p "$q: " a </dev/tty; echo "$a"; fi; }
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "Запустите под root (или через sudo)."; exit 1; }

say "Устанавливаем Docker и git"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git openssl
if ! command -v docker >/dev/null 2>&1; then
  # Docker из репозитория Ubuntu: его зеркала доступны из России
  apt-get install -y docker.io docker-compose-v2 || { curl -fsSL https://get.docker.com | sh; }
fi
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-v2

# Docker Hub ограничивает доступ из России — подключаем зеркало (Timeweb, открытое для всех)
mkdir -p /etc/docker
if [ ! -s /etc/docker/daemon.json ]; then
  echo '{ "registry-mirrors": ["https://dockerhub.timeweb.cloud"] }' > /etc/docker/daemon.json
fi
systemctl enable --now docker
systemctl restart docker

say "Скачиваем код сайта"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
cd "$DIR"

if [ ! -f .env ]; then
  say "Настройки сайта"
  DOMAIN=$(ask "Домен сайта, без https:// (например request-edu.ru)")
  OWNER_EMAIL=$(ask "Ваша почта — с неё вы будете входить как преподаватель")
  echo "Почта для кодов входа (SMTP). Можно пропустить: тогда коды будут видны в журнале сервера."
  SMTP_URL=$(ask "SMTP_URL (Enter — пропустить)" "")
  MAIL_FROM=$(ask "Имя и адрес отправителя" "ReQuest <no-reply@$DOMAIN>")
  cat > .env <<EOF
DOMAIN=$DOMAIN
APP_URL=https://$DOMAIN
OWNER_EMAIL=$OWNER_EMAIL
DB_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -hex 32)
SMTP_URL=$SMTP_URL
MAIL_FROM=$MAIL_FROM
EOF
  chmod 600 .env
fi

say "Собираем и запускаем (первый раз — несколько минут)"
docker compose up -d --build

DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2)
IP=$(curl -fsS https://ipv4.icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')
say "Готово"
cat <<EOF
Сайт запущен. Осталось направить домен на этот сервер:
  в панели регистратора домена создайте A-записи
    $DOMAIN      ->  $IP
    www.$DOMAIN  ->  $IP
Через 5–30 минут откройте https://$DOMAIN — сертификат HTTPS выпустится сам.

Полезные команды (из папки $DIR):
  обновить сайт:      git pull && docker compose up -d --build
  журнал сайта:       docker compose logs -f app
  копии базы:         ls backups/
EOF
