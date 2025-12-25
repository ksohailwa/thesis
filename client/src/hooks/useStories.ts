import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { StoryData } from '../types';

// Assuming the API returns an array of stories
export interface Story {
  _id: string;
  topic: string;
  cefr: string;
  language: string;
  content: StoryData;
  createdAt: string;
}

export const useStories = () => {
  return useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      const { data } = await api.get('/api/stories');
      return data as Story[];
    },
  });
};

export const useStory = (id: string) => {
  return useQuery({
    queryKey: ['story', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/stories/${id}`);
      return data as Story;
    },
    enabled: !!id,
  });
};
