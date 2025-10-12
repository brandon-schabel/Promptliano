import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/deep-research/$researchId')({
  component: DeepResearchDetailLayout
})

function DeepResearchDetailLayout() {
  return <Outlet />
}
