#!/bin/bash
# ============================================================
# Selfie Worker — Deploy Script para Digital Ocean Droplet
#
# USO:
#   1. Copie a pasta selfie-worker/ para o servidor:
#      scp -r selfie-worker/ root@167.172.246.99:/opt/
#
#   2. SSH no servidor e execute:
#      ssh root@167.172.246.99
#      cd /opt/selfie-worker && bash deploy.sh
#
# O script instala tudo e configura o worker como serviço.
# ============================================================

set -e

echo "═══════════════════════════════════════════"
echo "  Selfie Worker — Deploy"
echo "═══════════════════════════════════════════"

WORKER_DIR="/opt/selfie-worker"
VENV_DIR="$WORKER_DIR/venv"
SERVICE_NAME="selfie-worker"

# --- 1. Instalar dependências do sistema ---
echo ""
echo "[1/6] Instalando dependências do sistema..."
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv ffmpeg > /dev/null 2>&1
echo "  ✓ Python3, pip, venv, FFmpeg instalados"

# --- 2. Criar virtual environment ---
echo ""
echo "[2/6] Criando virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
echo "  ✓ venv criado em $VENV_DIR"

# --- 3. Instalar dependências Python ---
echo ""
echo "[3/6] Instalando dependências Python..."
pip install --upgrade pip -q
pip install -r "$WORKER_DIR/requirements.txt" -q
echo "  ✓ Dependências instaladas"

# --- 4. Pré-baixar modelo Whisper ---
echo ""
echo "[4/6] Baixando modelo Whisper (base)..."
python3 -c "import whisper; whisper.load_model('base'); print('  ✓ Modelo Whisper base baixado')"

# --- 5. Verificar .env ---
echo ""
echo "[5/6] Verificando configuração..."
if [ ! -f "$WORKER_DIR/.env" ]; then
    echo "  ✗ ERRO: Arquivo .env não encontrado!"
    echo "    Copie o .env.example para .env e preencha as credenciais:"
    echo "    cp $WORKER_DIR/.env.example $WORKER_DIR/.env"
    exit 1
fi
echo "  ✓ Arquivo .env encontrado"

# Validar variáveis obrigatórias
source "$WORKER_DIR/.env" 2>/dev/null
MISSING=""
[ -z "$SUPABASE_URL" ] && MISSING="$MISSING SUPABASE_URL"
[ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && MISSING="$MISSING SUPABASE_SERVICE_ROLE_KEY"
[ -z "$OPENAI_API_KEY" ] && MISSING="$MISSING OPENAI_API_KEY"
[ -z "$ELEVENLABS_API_KEY" ] && MISSING="$MISSING ELEVENLABS_API_KEY"
[ -z "$META_WHATSAPP_TOKEN" ] && MISSING="$MISSING META_WHATSAPP_TOKEN"

if [ -n "$MISSING" ]; then
    echo "  ✗ ERRO: Variáveis faltando no .env:$MISSING"
    exit 1
fi
echo "  ✓ Todas as variáveis configuradas"

# --- 6. Criar serviço systemd ---
echo ""
echo "[6/6] Configurando serviço systemd..."

cat > /etc/systemd/system/$SERVICE_NAME.service << 'UNIT'
[Unit]
Description=Selfie Video Pipeline Worker
After=network.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/selfie-worker
ExecStart=/opt/selfie-worker/venv/bin/python -u worker.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=selfie-worker

# Graceful shutdown (SIGTERM → worker finaliza step atual)
KillSignal=SIGTERM
TimeoutStopSec=300

# Limits
MemoryMax=4G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME

echo "  ✓ Serviço '$SERVICE_NAME' configurado e iniciado"

# --- Status ---
echo ""
echo "═══════════════════════════════════════════"
echo "  Deploy concluído!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Comandos úteis:"
echo "    Ver status:     systemctl status $SERVICE_NAME"
echo "    Ver logs:       journalctl -u $SERVICE_NAME -f"
echo "    Reiniciar:      systemctl restart $SERVICE_NAME"
echo "    Parar:          systemctl stop $SERVICE_NAME"
echo ""

systemctl status $SERVICE_NAME --no-pager -l 2>/dev/null || true
