/**
 * HubSpot User Data Integration
 * Manages syncing user data to HubSpot CRM and adding users to specific lists
 */

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_USER_DATA_LIST_ID = process.env.HUBSPOT_USER_DATA_LIST_ID || '2605';

if (!HUBSPOT_API_KEY) {
  console.warn('[HubSpot UserData] HUBSPOT_API_KEY environment variable is not set');
}

/**
 * Interface for user data to sync with HubSpot
 */
export interface UserDataForHubSpot {
  email: string;
  name?: string;
  userId?: string;
  gdpr?: boolean;
  country?: string;
  is_student?: boolean;
  student_institution?: string;
  is_founder?: boolean;
  founder_company_name?: string;
  is_employee?: boolean;
  employee_company_name?: string;
  employee_role?: string;
  is_enthusiast?: boolean;
}

/**
 * Sync user data to HubSpot and add them to the user data list
 * This function creates/updates a contact in HubSpot and adds them to the specified list
 *
 * @param userData - User data to sync to HubSpot
 * @param listId - Optional list ID (defaults to HUBSPOT_USER_DATA_LIST_ID env variable)
 * @returns Promise<boolean> - Returns true if successful, false otherwise
 */
export async function syncUserDataToHubSpot(
  userData: UserDataForHubSpot,
  listId?: string
): Promise<boolean> {
  const targetListId = listId || HUBSPOT_USER_DATA_LIST_ID;

  if (!HUBSPOT_API_KEY) {
    console.error('[HubSpot UserData] Cannot sync user: HUBSPOT_API_KEY is not configured');
    return false;
  }

  if (!targetListId) {
    console.error('[HubSpot UserData] Cannot sync user: List ID is not provided');
    return false;
  }

  try {
    // Step 1: Find or create the contact in HubSpot using their email
    // We need to get the contact's record ID to add them to the list
    const contactId = await getOrCreateUserDataContact(userData);

    if (!contactId) {
      console.error('[HubSpot UserData] Failed to get or create contact for:', userData.email);
      return false;
    }

    // Step 2: Add the contact to the user data list using the memberships API
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/lists/${targetListId}/memberships/add-and-remove`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify({
          recordIdsToAdd: [contactId],
          recordIdsToRemove: [],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[HubSpot UserData] Failed to add user to list ${targetListId}:`,
        response.status,
        errorText
      );
      return false;
    }

    const result = await response.json();
    console.log(
      `[HubSpot UserData] Successfully added user to list ${targetListId}:`,
      userData.email,
      'Contact ID:',
      contactId
    );

    // Log if the contact was already in the list (won't be in recordIdsAdded)
    if (!result.recordIdsAdded?.includes(contactId)) {
      console.log(`[HubSpot UserData] User ${userData.email} was already in the list`);
    }

    return true;
  } catch (error) {
    console.error('[HubSpot UserData] Error syncing user data:', error);
    return false;
  }
}

/**
 * Get or create a contact in HubSpot for user data and return their record ID
 *
 * @param userData - User data to create/find in HubSpot
 * @returns Promise<string | null> - Contact record ID or null if failed
 */
async function getOrCreateUserDataContact(
  userData: UserDataForHubSpot
): Promise<string | null> {
  if (!HUBSPOT_API_KEY) {
    return null;
  }

  try {
    // First, try to find the contact by email
    const searchResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: userData.email,
                },
              ],
            },
          ],
          properties: ['email', 'firstname', 'lastname'],
        }),
      }
    );

    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();

      if (searchResult.results && searchResult.results.length > 0) {
        // Contact exists, return their ID
        const contactId = searchResult.results[0].id;
        console.log(`[HubSpot UserData] Found existing contact: ${userData.email} (ID: ${contactId})`);

        // Update the contact with any provided data
        await updateUserDataContact(contactId, userData);

        return contactId;
      }
    }

    // Contact doesn't exist, create a new one
    // Email is the only mandatory field, all others are optional
    const properties: Record<string, any> = {
      email: userData.email,
      ...(userData.name && { fullname: userData.name.trim() }),
      ...(userData.gdpr !== undefined && { gdpr: userData.gdpr }),
      ...(userData.country && { country: userData.country }),
      ...(userData.is_student !== undefined && { is_student: userData.is_student }),
      ...(userData.student_institution && { student_institution: userData.student_institution }),
      ...(userData.is_founder !== undefined && { is_founder: userData.is_founder }),
      ...(userData.founder_company_name && { founder_company_name: userData.founder_company_name }),
      ...(userData.is_employee !== undefined && { is_employee: userData.is_employee }),
      ...(userData.employee_company_name && { employee_company_name: userData.employee_company_name }),
      ...(userData.employee_role && { employee_role: userData.employee_role }),
      ...(userData.is_enthusiast !== undefined && { is_enthusiast: userData.is_enthusiast }),
    }

    const createResponse = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify({
          properties,
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(
        '[HubSpot UserData] Failed to create contact:',
        createResponse.status,
        errorText
      );
      return null;
    }

    const createResult = await createResponse.json();
    console.log(`[HubSpot UserData] Created new contact: ${userData.email} (ID: ${createResult.id})`);

    return createResult.id;
  } catch (error) {
    console.error('[HubSpot UserData] Error getting or creating contact:', error);
    return null;
  }
}

/**
 * Update an existing user data contact in HubSpot
 *
 * @param contactId - HubSpot contact ID
 * @param userData - User data to update
 */
async function updateUserDataContact(
  contactId: string,
  userData: UserDataForHubSpot
): Promise<void> {
  if (!HUBSPOT_API_KEY) {
    return;
  }

  try {
    const properties: Record<string, any> = {
      ...(userData.name && { fullname: userData.name.trim() }),
      ...(userData.gdpr !== undefined && { gdpr: userData.gdpr }),
      ...(userData.country && { country: userData.country }),
      ...(userData.is_student !== undefined && { is_student: userData.is_student }),
      ...(userData.student_institution && { student_institution: userData.student_institution }),
      ...(userData.is_founder !== undefined && { is_founder: userData.is_founder }),
      ...(userData.founder_company_name && { founder_company_name: userData.founder_company_name }),
      ...(userData.is_employee !== undefined && { is_employee: userData.is_employee }),
      ...(userData.employee_company_name && { employee_company_name: userData.employee_company_name }),
      ...(userData.employee_role && { employee_role: userData.employee_role }),
      ...(userData.is_enthusiast !== undefined && { is_enthusiast: userData.is_enthusiast }),
    };

    // Only make API call if there are properties to update
    if (Object.keys(properties).length === 0) {
      return;
    }

    await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify({
          properties,
        }),
      }
    );

    console.log(`[HubSpot UserData] Updated contact: ${userData.email} (ID: ${contactId})`);
  } catch (error) {
    console.error('[HubSpot UserData] Error updating contact:', error);
  }
}
