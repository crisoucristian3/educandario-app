import { createClient } from '@supabase/supabase-js';

// Substitua estas duas strings pelas chaves reais do seu projeto no Supabase
const supabaseUrl = 'https://uvaouxcnbqwpwmqnmltt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2YW91eGNuYnF3cHdtcW5tbHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODAzNDksImV4cCI6MjEwNTY1NjM0OX0.-U-QtcwewUUHOXsxGWTB28sPuNkdiTJItbycLfIeEEQ';

export const supabase = createClient(supabaseUrl, supabaseKey);