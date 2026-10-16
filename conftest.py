import os

# Importing the app builds its Redis client and CORS middleware, which insist on
# these. Nothing in the suite connects, so placeholders keep the tests
# independent of a local .env.
for name, placeholder in {
    "REDIS_HOST": "localhost",
    "REDIS_PORT": "6379",
    "REDIS_DB": "0",
    "REDIS_PASSWORD": "test",
    "CORS_ORIGINS": "http://localhost:5173",
}.items():
    os.environ.setdefault(name, placeholder)
