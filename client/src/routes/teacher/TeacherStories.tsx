import { useParams } from 'react-router-dom'
import StoryManager from './StoryManager'

export default function TeacherStories() {
  const { id } = useParams()
  if (!id) return null
  return <StoryManager experimentId={id} />
}
