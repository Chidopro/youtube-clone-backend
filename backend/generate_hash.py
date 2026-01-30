"""
DEV/ONE-OFF ONLY. Do not run in production.
Prints password hash and SQL - sensitive output. Remove or secure after use.
"""
import bcrypt

password = 'VieG369Bbk8!'
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
print(f"Password: {password}")
print(f"Bcrypt Hash: {hashed}")
print("\nSQL Update Statement:")
print(f"UPDATE users SET password_hash = '{hashed}' WHERE email = 'filialsons@gmail.com';")
