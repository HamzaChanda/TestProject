import { SearchX } from "lucide-react";
import { Card } from "./Card";
import { ButtonLink } from "./Button";
import { EmptyState } from "./Primitives";

export function NotFoundState({ entity, backHref }: { entity: string; backHref: string }) {
  return (
    <Card>
      <EmptyState
        icon={<SearchX />}
        title={`${entity} not found`}
        description={`This ${entity.toLowerCase()} may have been deleted, or the link is incorrect.`}
        action={
          <ButtonLink href={backHref} variant="secondary">
            Go back
          </ButtonLink>
        }
      />
    </Card>
  );
}
