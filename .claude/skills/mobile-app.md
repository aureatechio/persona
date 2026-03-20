---
name: mobile-app
description: Load Arena Mobile (Expo/React Native) project context. Use when working on the mobile app to avoid touching the Next.js web project.
user_invocable: true
---

# Arena Mobile App Context

Before making ANY changes, read the mobile app reference document:

1. Read `/Users/arthurcavallini/.claude/projects/-Users-arthurcavallini-Documents-syntheticPerson/memory/reference_arena_mobile.md`

2. The mobile app is at `/Users/arthurcavallini/Documents/arena-mobile/` — this is a SEPARATE Expo/React Native project. NEVER edit files in `/Users/arthurcavallini/Documents/syntheticPerson/` when working on mobile.

3. Key files:
   - Screens: `arena-mobile/app/(tabs)/*.tsx`
   - Components: `arena-mobile/components/*.tsx`
   - Store: `arena-mobile/store/arenaStore.ts`
   - Types: `arena-mobile/lib/types.ts`

4. Stack: Expo 54, React Native 0.81, Zustand, expo-router v6, react-native-reanimated, react-native-webview

5. After reading the reference doc, proceed with the user's request.
