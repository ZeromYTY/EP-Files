#!/bin/bash

echo "🚀 Запуск проекта EP-Files"
echo ""

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo "❌ Виртуальное окружение не найдено!"
    echo "Создайте его командой: python3 -m venv venv"
    exit 1
fi

# Остановка существующих процессов
echo "🛑 Остановка существующих процессов..."
pkill -f "manage.py runserver" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Активация виртуального окружения
echo "📦 Активация виртуального окружения..."
source venv/bin/activate

# Применение миграций
echo "🔄 Применение миграций..."
python manage.py migrate

# Запуск Django сервера в фоне
echo "🐍 Запуск Django сервера на http://localhost:8000..."
python manage.py runserver &
DJANGO_PID=$!

# Ожидание запуска Django
sleep 3

# Проверка запуска Django
if curl -s http://127.0.0.1:8000/ > /dev/null; then
    echo "✅ Django сервер запущен успешно!"
else
    echo "❌ Ошибка запуска Django сервера!"
    exit 1
fi

# Запуск React frontend
echo "⚛️  Запуск React frontend на http://localhost:5173..."
cd frontend
npm run dev &
REACT_PID=$!

echo ""
echo "✅ Проект запущен!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/ (список endpoints)"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Функция для остановки процессов при выходе
cleanup() {
    echo ""
    echo "🛑 Остановка серверов..."
    kill $DJANGO_PID 2>/dev/null
    kill $REACT_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Ожидание завершения
wait $DJANGO_PID $REACT_PID
