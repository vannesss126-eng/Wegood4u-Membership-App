import { supabase } from '@/lib/supabase';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadProfileImage(
  userId: string,
  imageUri: string
): Promise<UploadResult> {
  try {
    // Get the file extension from the URI
    const fileExtension = imageUri.split('.').pop() || 'jpg';
    const fileName = `${userId}/profile_${Date.now()}.${fileExtension}`;

    // Convert the image URI to arrayBuffer and then to Uint8Array
    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Infer content type from response headers if available, fallback to inferred type
    const contentType = response.headers.get('Content-Type') || `image/${fileExtension}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('profilePic')
      .upload(fileName, uint8Array, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return {
        success: false,
        error: `Failed to upload image: ${error.message}`,
      };
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('profilePic')
      .getPublicUrl(fileName);

    return {
      success: true,
      url: publicUrlData.publicUrl,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while uploading the image.',
    };
  }
}

export async function updateUserAvatar(
  userId: string,
  avatarUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (error) {
      console.error('Database update error:', error);
      return {
        success: false,
        error: `Failed to update profile: ${error.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Update error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while updating your profile.',
    };
  }
}