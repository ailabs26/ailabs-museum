#!/usr/bin/env bash

# ==============================================================================
# Aura Museum - Start Script for Backend & Frontend
# Sử dụng: ./start.sh hoặc bash start.sh
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/back-end"
FRONTEND_DIR="$ROOT_DIR/front-end"

# Màu hiển thị terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BOLD}${CYAN}            🏛️   AURA MUSEUM - KHỞI CHẠY HỆ THỐNG             ${NC}"
echo -e "${BLUE}================================================================${NC}"

# 1. Kiểm tra môi trường Node.js
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[LỖI] Chưa cài đặt Node.js. Vui lòng cài Node.js >= 20.${NC}"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}[LỖI] Chưa cài đặt npm.${NC}"
    exit 1
fi

# 2. Kiểm tra file .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${YELLOW}[!] Không tìm thấy back-end/.env, đang sao chép từ .env.example...${NC}"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

if [ ! -f "$FRONTEND_DIR/.env" ]; then
    echo -e "${YELLOW}[!] Không tìm thấy front-end/.env, đang sao chép từ .env.example...${NC}"
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
fi

# 3. Kiểm tra node_modules
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}[!] Đang cài đặt thư viện cho back-end...${NC}"
    (cd "$BACKEND_DIR" && npm install)
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}[!] Đang cài đặt thư viện cho front-end...${NC}"
    (cd "$FRONTEND_DIR" && npm install)
fi

# 4. Dọn dẹp cổng nếu đang bị chiếm
for PORT in 3001 5173; do
    PID=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo -e "${YELLOW}[!] Cổng $PORT đang có tiến trình (PID: $PID), giải phóng cổng...${NC}"
        kill -9 $PID 2>/dev/null || true
    fi
done

echo -e "\n${CYAN}[1/2] Đang khởi động Backend (NestJS API :3001)...${NC}"
(cd "$BACKEND_DIR" && npm run dev) &
BACKEND_PID=$!

echo -e "${CYAN}[2/2] Đang khởi động Frontend (Vite React :5173)...${NC}"
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!

# Bắt sự kiện thoát (Ctrl+C) để dọn dẹp sạch tiến trình
cleanup() {
    echo -e "\n\n${YELLOW}[!] Đang dừng các máy chủ...${NC}"
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
    echo -e "${GREEN}[✓] Đã dừng toàn bộ Backend & Frontend an toàn.${NC}"
    exit 0
}

trap cleanup INT TERM EXIT

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${GREEN}${BOLD}  ✅ HỆ THỐNG ĐÃ SẴN SÀNG! Bạn có thể truy cập các liên kết sau:${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "  🌐 ${BOLD}Trang chủ Client:${NC}       ${CYAN}http://localhost:5173/${NC}"
echo -e "  🏛️  ${BOLD}Bảo tàng 3D (Tour):${NC}     ${CYAN}http://localhost:5173/tour${NC}"
echo -e "  🔐 ${BOLD}Đăng nhập CMS Admin:${NC}    ${CYAN}http://localhost:5173/admin/login${NC}"
echo -e "     • Email:    ${YELLOW}admin@aura.local${NC}"
echo -e "     • Mật khẩu: ${YELLOW}Admin@123456${NC}"
echo -e "  📚 ${BOLD}Backend Swagger Docs:${NC}   ${CYAN}http://localhost:3001/api/docs${NC}"
echo -e "  🩺 ${BOLD}Kiểm tra Health:${NC}        ${CYAN}http://localhost:3001/api/health${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "${YELLOW}Nhấn Ctrl + C bất kỳ lúc nào để tắt cả 2 máy chủ.${NC}\n"

# Giữ script chạy và in log
wait

