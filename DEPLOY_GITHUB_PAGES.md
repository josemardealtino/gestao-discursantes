# Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie TODOS os arquivos desta pasta para a raiz do repositório.
3. Vá em Settings > Pages.
4. Em Build and deployment:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
5. Clique em Save.
6. Aguarde a publicação e abra o link exibido pelo GitHub Pages.

O site é estático e usa:
- HTML/CSS/JavaScript
- Supabase no navegador
- Font Awesome via CDN

A Publishable Key do Supabase pode ficar no front-end.
Nunca publique uma Secret Key ou service_role key.
