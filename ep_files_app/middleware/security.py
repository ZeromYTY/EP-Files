"""
Middleware для дополнительной безопасности
"""
import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Добавляет заголовки безопасности к ответам"""
    
    def process_response(self, request, response):
        # Защита от XSS
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Content Security Policy
        response['Content-Security-Policy'] = "default-src 'self'"
        
        # Referrer Policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        return response


class RateLimitMiddleware(MiddlewareMixin):
    """Простая защита от DDoS (rate limiting)"""
    
    # Хранилище запросов (в продакшене использовать Redis)
    request_counts = {}
    
    def process_request(self, request):
        # Получаем IP адрес
        ip = self.get_client_ip(request)
        
        # Проверяем количество запросов
        if ip in self.request_counts:
            count, timestamp = self.request_counts[ip]
            
            # Если больше 100 запросов в минуту - блокируем
            import time
            if time.time() - timestamp < 60:
                if count > 100:
                    logger.warning(f"Rate limit exceeded for IP: {ip}")
                    return JsonResponse({
                        'error': 'Слишком много запросов. Попробуйте позже.'
                    }, status=429)
                self.request_counts[ip] = (count + 1, timestamp)
            else:
                # Сбрасываем счетчик
                self.request_counts[ip] = (1, time.time())
        else:
            import time
            self.request_counts[ip] = (1, time.time())
        
        return None
    
    def get_client_ip(self, request):
        """Получает реальный IP клиента"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
