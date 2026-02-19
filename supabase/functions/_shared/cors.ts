export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });

