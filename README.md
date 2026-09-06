# Gestão Sacramental — V24 PWA

Esta versão adiciona suporte PWA, incluindo iPhone/iOS.

## O que foi adicionado
- `manifest.webmanifest`
- `sw.js`
- ícones 192x192 e 512x512
- `apple-touch-icon.png`
- favicon
- metatags específicos para iOS
- modo `standalone`
- cache do shell do aplicativo
- atualização via network-first para reduzir risco de versão antiga no GitHub Pages
- instruções de instalação dentro de Configurações quando aberto no iPhone pelo Safari

## Importante sobre iOS
No iPhone, a instalação é feita pelo Safari:
1. Compartilhar
2. Adicionar à Tela de Início
3. Adicionar

Depois disso, o sistema abre sem a barra normal do Safari, com aparência de aplicativo.

## Limitação offline
O shell visual pode abrir com cache, mas autenticação e dados continuam dependendo de conexão porque o backend é Supabase.

## Deploy
Substitua no GitHub:
- index.html
- css/
- js/
- assets/
- manifest.webmanifest
- sw.js

Não há alteração no banco.
