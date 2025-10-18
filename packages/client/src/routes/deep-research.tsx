import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/deep-research')({
  component: DeepResearchLayout
})

function DeepResearchLayout() {
  return <Outlet />
}
