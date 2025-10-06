#!/bin/bash

# Fix test files to pass mockEnv to app.request calls

# Add Env import and mockEnv to auth.test.ts
sed -i '' '
/import type { D1Database } from/a\
import type { Env } from '\''../index'\'';
' src/routes/auth.test.ts

sed -i '' '
/let mockD1: D1Database;/a\
  let mockEnv: Env;
' src/routes/auth.test.ts

sed -i '' '
/mockD1 = {/,/} as any;/{
  /} as any;/a\
\
    mockEnv = {\
      DB: mockD1,\
      STORAGE: {} as any,\
      ENVIRONMENT: '\''dev'\'',\
      JWT_SECRET: '\''test-secret'\'',\
      LOGTO_APP_SECRET: '\''test-logto-secret'\'',\
    };
}
' src/routes/auth.test.ts

# Replace app.request calls with mockEnv parameter in auth.test.ts
sed -i '' 's/await app\.request(/await app.request(/g; s/}, mockEnv);/, mockEnv);/g; s/});$/, mockEnv);/g' src/routes/auth.test.ts
sed -i '' 's/const res = await app\.request(\([^)]*\));/const res = await app.request(\1, mockEnv);/g' src/routes/auth.test.ts

# Add Env import and mockEnv to care-logs.test.ts
sed -i '' '
/import type { D1Database } from/a\
import type { Env } from '\''../index'\'';
' src/routes/care-logs.test.ts

sed -i '' '
/let mockD1: D1Database;/a\
  let mockEnv: Env;
' src/routes/care-logs.test.ts

sed -i '' '
/mockD1 = {/,/} as any;/{
  /} as any;/a\
\
    mockEnv = {\
      DB: mockD1,\
      STORAGE: {} as any,\
      ENVIRONMENT: '\''dev'\'',\
      JWT_SECRET: '\''test-secret'\'',\
      LOGTO_APP_SECRET: '\''test-logto-secret'\'',\
    };
}
' src/routes/care-logs.test.ts

# Replace app.request calls with mockEnv parameter in care-logs.test.ts
sed -i '' 's/const res = await app\.request(\([^)]*\));/const res = await app.request(\1, mockEnv);/g' src/routes/care-logs.test.ts

echo "Fixed all test files to include mockEnv"
