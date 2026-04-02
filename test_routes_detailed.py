#!/usr/bin/env python3
from backend.api.api_router import api_router
import sys
sys.path.insert(0, '/root')


print("Checking registered routes...")
print(f"Total routes: {len(api_router.routes)}")

for route in api_router.routes:
    if hasattr(route, 'path'):
        methods = []
        if hasattr(route, 'methods'):
            methods = list(route.methods)
        print(f"  {methods} {route.path}")
