#!/bin/bash
# Test and fix password hash for admin user

set +H  # Disable history expansion to avoid ! issues

echo "Getting current hash from database..."
HASH=$(docker exec worklenz_db psql -U postgres -d worklenz_db -t -c "SELECT password FROM users WHERE email='admin@llambit.io';" | tr -d ' \n\r')
echo "Current hash: ${HASH:0:30}..."

echo ""
echo "Testing current hash..."
docker exec worklenz_backend node -e 'const bcrypt=require("bcrypt");bcrypt.compare("Password123!",process.argv[1]).then(r=>console.log(r?"✅ VALID - Hash works!":"❌ INVALID - Hash does not work")).catch(e=>console.error("Error:",e));' "$HASH"

echo ""
echo "Generating new hash using backend bcrypt..."
NEW_HASH=$(docker exec worklenz_backend node -e 'const bcrypt=require("bcrypt");bcrypt.hash("Password123!",10).then(h=>console.log(h));' | tr -d '\n\r')

if [ -n "$NEW_HASH" ]; then
  echo "New hash generated: ${NEW_HASH:0:30}..."
  echo ""
  echo "Testing new hash..."
  docker exec worklenz_backend node -e 'const bcrypt=require("bcrypt");bcrypt.compare("Password123!",process.argv[1]).then(r=>console.log(r?"✅ New hash is VALID":"❌ New hash is INVALID")).catch(e=>console.error("Error:",e));' "$NEW_HASH"
  
  echo ""
  echo "Updating password in database..."
  docker exec worklenz_db psql -U postgres -d worklenz_db -c "UPDATE users SET password='$NEW_HASH' WHERE email='admin@llambit.io';"
  
  echo ""
  echo "✅ Password updated! Try logging in now with:"
  echo "   Email: admin@llambit.io"
  echo "   Password: Password123!"
  echo ""
  echo "To make this permanent, add to docker-compose.yml db service:"
  echo "  ADMIN_PASSWORD_HASH: \"$NEW_HASH\""
else
  echo "❌ Failed to generate new hash"
fi

