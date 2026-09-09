/**
 * Adapted from Origin UI Tabs, discovered on 21st.dev.
 * Copyright (c) 2025 Origin UI. MIT license — see THIRD_PARTY_NOTICES.md.
 * Tailwind utilities replaced by ComunIA CSS; use the focused Radix package.
 */
import type { ComponentProps } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

function Tabs({ className = '', ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={`origin-tabs ${className}`} {...props} />;
}
function TabsList({ className = '', ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={`origin-tabs-list ${className}`}
      {...props}
    />
  );
}
function TabsTrigger({ className = '', ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={`origin-tabs-trigger ${className}`}
      {...props}
    />
  );
}
function TabsContent({ className = '', ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={`origin-tabs-content ${className}`}
      {...props}
    />
  );
}
export { Tabs, TabsList, TabsTrigger, TabsContent };
