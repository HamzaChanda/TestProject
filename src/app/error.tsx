"use client";

import { useEffect } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Primitives";

/** Route-level error boundary: a crash in one page never blanks the whole app. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mx-auto mt-10 max-w-xl">
      <EmptyState
        icon={<AlertOctagon />}
        title="Something went wrong on this page"
        description="Your data is safe — nothing was changed. Try again, or head back to the dashboard."
        action={
          <>
            <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={reset}>
              Try again
            </Button>
            <ButtonLink href="/dashboard">Back to dashboard</ButtonLink>
          </>
        }
      />
    </Card>
  );
}
