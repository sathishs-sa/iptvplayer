import React from 'react';
import { useRouter } from 'expo-router';
import { Button, EmptyState, Screen } from '../src/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <EmptyState icon="compass-outline" title="Page not found" message="That address doesn't exist." action={<Button label="Back to channels" onPress={() => router.replace('/')} />} />
    </Screen>
  );
}
