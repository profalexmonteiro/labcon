(function () {
  "use strict";

  const supabaseUrl = "https://qbnxsssutkuiitqishel.supabase.co";
  const supabaseKey = "sb_publishable_liCRlozF3LjJHIOAfbAB-Q_p4XSwngB";
  const stateTable = "labcon_state";
  const stateId = "default";
  const allowedRoles = new Set(["aluno", "professor", "tecnico", "administrador"]);

  const client = window.supabase?.createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  function normalizeRole(role) {
    return allowedRoles.has(role) ? role : "aluno";
  }

  window.LabConSupabase = {
    client,
    isReady: Boolean(client),

    async getSession() {
      if (!client) return null;

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async requireSession() {
      const session = await this.getSession();
      if (!session) {
        window.location.replace("login.html");
        return null;
      }
      return session;
    },

    roleFromUser(user) {
      return normalizeRole(user?.app_metadata?.role || user?.user_metadata?.role);
    },

    async loadState(fallbackState) {
      if (!client) return fallbackState;

      const { data, error } = await client
        .from(stateTable)
        .select("data")
        .eq("id", stateId)
        .maybeSingle();

      if (error) throw error;
      return data?.data ? { ...fallbackState, ...data.data } : fallbackState;
    },

    async saveState(state) {
      if (!client) return;
      const session = await this.getSession();
      if (!session) throw new Error("Sessao obrigatoria para gravar dados.");

      const { error } = await client
        .from(stateTable)
        .upsert({
          id: stateId,
          data: state,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (error) throw error;
    }
  };
}());
