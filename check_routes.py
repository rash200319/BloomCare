#!/usr/bin/env python3
from backend.api.api_router import api_router

print(f'Routes registered: {len(api_router.routes)}')
for r in api_router.routes:
    if hasattr(r, 'path'):
        print(f'  {r.path}')
