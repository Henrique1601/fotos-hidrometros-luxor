<div align="center">

# 💧 FotoHidro — Condomínio Luxor e Lutécia (PWA)

**PWA mobile-first 100% offline para coleta de fotos de hidrômetros em alta definição com download imediato nomeado por sala/medidor.**

![React](https://img.shields.io/badge/React-18-5eead4?style=flat-square&logo=react&logoColor=white&color=0f766e)
![Vite](https://img.shields.io/badge/Vite-5-5eead4?style=flat-square&logo=vite&logoColor=white&color=0f766e)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-5eead4?style=flat-square&logo=typescript&logoColor=white&color=0f766e)
![PWA](https://img.shields.io/badge/PWA-offline%20ready-5eead4?style=flat-square&logo=pwa&logoColor=white&color=0f766e)
![License](https://img.shields.io/badge/license-MIT-5eead4?style=flat-square)

</div>

---

## ✨ Destaques do Sistema

1. **⚡ Download Imediato ao Fotografar**:
   - No instante em que você bate a foto, além de salvar no banco offline (`IndexedDB`), o app **baixa imediatamente o arquivo `.jpg`** no dispositivo já com a nomenclatura exata da sala e do medidor (`501.jpg`, `502-1.jpg`, `502-2.jpg`, `Cafe.jpg`, `Bem_Barato.jpg`, `Banco_do_Brasil-1.jpg`, `Estacionamento-1.jpg`...).
2. **🏢 Condomínio Luxor e Lutécia Pré-Carregado (140 Salas / 205 Medidores)**:
   - Mapeado fielmente a partir do relatório oficial da **HydroJEXE / NP Administração** (5º ao 10º andar + Café, Bem Barato, Banco do Brasil e Estacionamento).
   - **Código de Cores Oficial no Visor da Câmera**:
     - 🩵 **1 Medidor**: Salas com medidor único (`501.jpg`)
     - 🟡 **2 Medidores (Amarelo)**: Pede 2 fotos seguidas (`502-1.jpg` e `502-2.jpg`)
     - 🔵 **4 Medidores (Azul)**: Estacionamento (`Estacionamento-1.jpg` a `Estacionamento-4.jpg`)
3. **📥 Multi-Prédio com Importação de Planilha Excel**:
   - Permite importar qualquer outro prédio via planilha `.xlsx` ou `.csv` (com botão para baixar planilha modelo).
4. **📦 Exportações Completas**:
   - **ZIP** com todas as fotos em alta definição.
   - **PDF** formatado com tabela de status e galeria visual das fotos.
   - **Planilha Excel (.xlsx)** de conferência dos 205 medidores.

---

## 🚀 Como Executar

```bash
npm install        # Instala dependências
npm run dev        # Servidor de desenvolvimento
npm run test       # Executa suíte de testes (Vitest)
npm run build      # Compila para produção (TypeScript + Vite PWA)
```

---

## 📄 Licença

MIT License © 2026 **Henrique Bezerra Dos Santos**
