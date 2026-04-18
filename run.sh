#!/bin/bash

echo "🚀 Запуск проекта EP-Files"
echo ""

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo "❌ Виртуальное окружение не найдено!"
    echo "Создайте его командой: python3 -m venv venv"
    exit 1
fi

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

# Запуск React frontend
echo "⚛️  Запуск React frontend на http://localhost:5173..."
cd frontend
npm run dev &
REACT_PID=$!

echo ""
echo "✅ Проект запущен!"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend: http://localhost:8000"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Ожидание завершения
wait $DJANGO_PID $REACT_PID
