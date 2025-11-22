import { useNavigate, useParams } from 'react-router-dom'
import { StoryManager } from './StoryManager'

export default function TeacherStories() {
  const { id } = useParams()
  const nav = useNavigate()
  if (!id) return null
  return <StoryManager experimentId={id} onDone={() => nav(`/teacher/experiments/${id}`)} />
}
