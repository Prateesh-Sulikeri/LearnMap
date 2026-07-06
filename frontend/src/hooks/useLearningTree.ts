import { useQuery } from '@tanstack/react-query'
import { itemsApi } from '@/services/itemsApi'
import { buildTree } from '@/utils/tree'

export function useLearningTree() {
  const query = useQuery({
    queryKey: ['items'],
    queryFn: itemsApi.list,
  })

  const tree = query.data ? buildTree(query.data) : []

  return { ...query, tree }
}
