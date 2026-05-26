"""
Middleware для дополнительной безопасности
"""
import logging
import time
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from ep_files_app.api.authentication import EpFilesJWTAuthentication

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Middleware для автоматического добавления HTTP-заголовков безопасности в ответы сервера.

    Модифицирует каждый исходящий ответ (HttpResponse) приложения, внедряя защитные
    заголовки, которые предотвращают уязвимости типа Clickjacking, XSS, MIME-sniffing,
    а также регулируют правила передачи метаданных о реферере (Referrer Policy).

    Methods:
        process_response(request, response): Внедряет заголовки безопасности в объект ответа.
    """

    def process_response(self, _request, response):
        """Инжектирует защитные HTTP-заголовки в исходящий ответ сервера.

                Устанавливает параметры ``X-Content-Type-Options``, ``X-Frame-Options``,
                ``X-XSS-Protection``, строгие правила ``Content-Security-Policy``
                (только собственный ориджин) и безопасную политику передачи реферера.

                Args:
                    request (HttpRequest): Объект текущего веб-запроса Django.
                    response (HttpResponse): Объект сформированного ответа, подлежащий модификации.

                Returns:
                    HttpResponse: Модифицированный объект ответа с добавленными заголовками.
        """
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'

        response['Content-Security-Policy'] = "default-src 'self'"

        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        return response


class RateLimitMiddleware(MiddlewareMixin):
    """Middleware для ограничения частоты запросов (Rate Limiting) с целью защиты от DDoS-атак.

    Релизует алгоритм фиксации количества обращений от клиентов в оперативной памяти
    (в рамках одного рабочего процесса сервера). Ограничивает лимит до 100 запросов в минуту
    для одного IP-адреса. При превышении лимита блокирует обработку, возвращая HTTP-статус 429.

    Attributes:
        request_counts (dict): Внутренний статический реестр для учета транзакций. Хранит данные
            в формате ``{ip_address: (count, timestamp)}``.

    Methods:
        process_request(request): Проверяет текущую частоту запросов для IP-адреса клиента.
        get_client_ip(request): Извлекает фактический IP-адрес из метаданных запроса.
    """

    request_counts = {}
    jwt_authentication = EpFilesJWTAuthentication()

    def process_request(self, request):
        """Анализирует частоту запросов текущего пользователя перед передачей контроллеру.

                Вычисляет разницу во времени с момента первого запроса в текущем минутном окне.
                Если лимит в 100 запросов превышен, логирует инцидент и прерывает конвейер,
                возвращая JSON-структуру с ошибкой.

                Args:
                    request (HttpRequest): Объект входящего веб-запроса Django.

                Returns:
                    Optional[JsonResponse]: объект ``JsonResponse`` со статусом
                    429 Too Many Requests, если лимит исчерпан, иначе ``None``.
                """
        ip = self.get_client_ip(request)

        if ip in self.request_counts:
            count, timestamp = self.request_counts[ip]

            if time.time() - timestamp < 60:
                if count > 100:
                    if self.is_admin_request(request):
                        self.request_counts[ip] = (count + 1, timestamp)
                        return None
                    logger.warning("Rate limit exceeded for IP: %s", ip)
                    return JsonResponse({
                        'error': 'Слишком много запросов. Попробуйте позже.'
                    }, status=429)
                self.request_counts[ip] = (count + 1, timestamp)
            else:
                self.request_counts[ip] = (1, time.time())
        else:
            self.request_counts[ip] = (1, time.time())

        return None

    def is_admin_request(self, request):
        """Проверяет, принадлежит ли запрос администратору."""
        user = getattr(request, "user", None)
        if self.is_admin_user(user):
            return True

        try:
            auth_result = self.jwt_authentication.authenticate(request)
        except AuthenticationFailed:
            return False

        if not auth_result:
            return False

        jwt_user, _ = auth_result
        return self.is_admin_user(jwt_user)

    @staticmethod
    def is_admin_user(user):
        """Проверяет флаги администратора у пользователя."""
        return bool(
            user
            and getattr(user, "is_authenticated", False)
            and (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))
        )

    def get_client_ip(self, request):
        """Определяет реальный IP-адрес клиента, учитывая прокси-серверы и балансировщики.

        Выполняет поиск заголовка ``HTTP_X_FORWARDED_FOR``. Если он присутствует,
        извлекает первый адрес из цепочки перенаправлений, в противном случае
        использует стандартный адрес удаленного узла из ``REMOTE_ADDR``.

        Args:
            request (HttpRequest): Объект текущего веб-запроса Django.

        Returns:
            str: Строковое представление IP-адреса клиента (IPv4 или IPv6).

        Examples:
            >>> middleware = RateLimitMiddleware(None)
            >>> middleware.get_client_ip(request)
            '192.168.1.100'
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
