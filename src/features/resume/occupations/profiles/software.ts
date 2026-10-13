import type { OccupationProfile } from '../types';

export const softwareProfile = {
  id: 'software',
  label: 'Software & Technology',
  description: 'Questions for software engineering, development, and technology roles.',
  groups: [
    {
      id: 'software-technical-stack',
      title: 'Technical stack',
      questions: [
        {
          id: 'software-languages',
          profileId: 'software',
          label: 'What are your main programming languages?',
          type: 'text',
          placeholder: 'List only languages you have used.',
        },
        {
          id: 'software-frameworks',
          profileId: 'software',
          label: 'What frameworks or libraries have you used?',
          type: 'text',
        },
        {
          id: 'software-databases',
          profileId: 'software',
          label: 'What databases have you used?',
          type: 'text',
        },
        {
          id: 'software-cloud',
          profileId: 'software',
          label: 'What cloud platforms have you used?',
          type: 'text',
        },
        {
          id: 'software-ci-cd',
          profileId: 'software',
          label: 'What CI/CD tools have you used?',
          type: 'text',
        },
      ],
    },
    {
      id: 'software-projects-teamwork',
      title: 'Projects and teamwork',
      questions: [
        {
          id: 'software-github',
          profileId: 'software',
          label: 'What is your GitHub profile URL?',
          type: 'text',
          placeholder: 'https://github.com/your-name',
        },
        {
          id: 'software-projects',
          profileId: 'software',
          label: 'Which projects are most relevant to this role?',
          type: 'text',
          multiline: true,
          helpText: 'Describe only projects you actually completed or contributed to.',
        },
        {
          id: 'software-team-experience',
          profileId: 'software',
          label: 'What experience do you have working in a software team?',
          type: 'text',
          multiline: true,
        },
      ],
    },
  ],
} satisfies OccupationProfile<'software'>;
