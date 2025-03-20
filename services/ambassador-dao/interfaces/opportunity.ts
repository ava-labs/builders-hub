export interface IJobDataType {
    job: {
      id: number;
      title: string;
      company: string;
      duration: string;
      proposals: number;
      reward: number;
      currency: string;
      total_budget: string;
      end_date: string;
      created_by: {
        company_profile: {
          name: string;
          logo: string;
        }
      }
      skills: [{
        id: string;
        name: string;
      }]
    };
  }



  export interface IBountyDataType {
    bounty: {
      id: number;
      title: string;
      company: string;
      duration: string;
      proposals: number;
      reward: number;
      currency: string;
      total_budget: string;
      end_date: string;
      created_by: {
        company_profile: {
          name: string;
          logo: string;
        }
      }
      skills: [{
        id: string;
        name: string;
      }]
    };
  }