from .client import RedisClient

redis_client = RedisClient()

__all__ = ["RedisClient", "redis_client"]
