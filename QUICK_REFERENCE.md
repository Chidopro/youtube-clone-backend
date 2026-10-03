# 🚀 SCREENMERCH QUICK REFERENCE
**STATUS:** ✅ WORKING - LOCKED IN

---

## 🔑 CRITICAL FIXES (If Something Breaks)

### Database Trigger Fix
```sql
-- Run this in Supabase SQL Editor if signup fails
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS valid_tier;
ALTER TABLE user_subscriptions ADD CONSTRAINT valid_tier
CHECK (tier IN ('free', 'pro', 'basic', 'premium', 'creator_network'));

DROP TRIGGER IF EXISTS auto_create_user_subscription ON users;
DROP FUNCTION IF EXISTS create_user_subscription();

CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_create_user_subscription
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_subscription();
```

### Key Files (Don't Touch Unless Necessary)
- `frontend/src/Pages/Login/Login.jsx` - Signup logic
- `frontend/src/Components/Navbar/Navbar.jsx` - Dropdown menu
- `frontend/src/Pages/SubscriptionSuccess/SubscriptionSuccess.jsx` - Instructions

---

## 🌐 LIVE URLs
- **Frontend:** https://screenmerch.com
- **Backend:** https://screenmerch.fly.dev

---

## 🧪 TESTING FLOW
1. Get Started Free → Calculator
2. Get Started → Signup
3. Create account → PayPal setup
4. Complete PayPal → Instructions
5. Check dropdown menu → Instructions & Link

---

## 🆘 EMERGENCY COMMANDS
```bash
# Check backend logs
flyctl logs --app screenmerch

# Deploy frontend
cd frontend
npm run build
npx netlify deploy --prod --dir=dist

# Deploy backend
cd backend
flyctl deploy --app screenmerch
```

---

**✅ CURRENT STATE:** FULLY FUNCTIONAL - READY FOR MOBILE IMPROVEMENTS
