# Instalando o Oikos no seu computador

O Oikos funciona no seu próprio computador. As informações da sua família ficam nesse computador e não são enviadas para lugar nenhum. Escolha abaixo o tipo do seu computador.

Antes de começar, você vai precisar do arquivo instalador que eu te enviei:

- **Windows:** um arquivo chamado `Oikos Setup 0.1.0.exe` (o número pode ser outro).
- **Mac:** um arquivo terminado em `.dmg`. Existem dois tipos, e você precisa do certo:
  - `Oikos-0.1.0-arm64.dmg` para os Macs mais novos (Apple M1, M2, M3 e seguintes).
  - `Oikos-0.1.0-x64.dmg` para os Macs mais antigos, com chip Intel.
  - Não sabe qual é o seu? Clique no menu da maçã e depois em **Sobre Este Mac**. Se aparecer "Chip: Apple M...", use o `arm64`. Se aparecer "Processador: Intel...", use o `x64`.

O Oikos não é vendido nas lojas de aplicativos, então o Windows e o macOS mostram um aviso na primeira vez. Isso é esperado, e os passos abaixo te ajudam a passar por ele.

## Windows

1. Dê dois cliques em `Oikos Setup 0.1.0.exe`.
2. Se aparecer "O Windows protegeu seu computador" ('Windows protected your PC'), clique em **Mais informações → Executar assim mesmo** (**More info → Run anyway**).

   ![Aviso do Windows](images/windows-smartscreen.png)

   <!-- TODO: adicionar uma captura de tela da janela "O Windows protegeu seu computador" com "Mais informações" e "Executar assim mesmo" -->

3. Espere a instalação terminar. O Oikos abre sozinho.

**Se o Windows disser que o "Smart App Control" bloqueou o app:** alguns computadores com Windows 11 bloqueiam apps como este por completo, sem o botão "Executar assim mesmo". Fale comigo e eu te ajudo a partir daí. Você não precisa mudar nenhuma configuração do Windows.

## Mac

1. Abra o DMG e arraste o Oikos para a pasta Aplicativos. Abra o Oikos; quando o macOS bloquear, vá em **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim** (**System Settings → Privacy & Security → Open Anyway**). Se o macOS disser que o app "está danificado" ('is damaged'), rode `xattr -cr /Applications/Oikos.app` no Terminal, ou me ligue.

   ![Aviso do macOS](images/macos-gatekeeper.png)

   <!-- TODO: adicionar uma captura de tela de Ajustes do Sistema > Privacidade e Segurança com o botão "Abrir Mesmo Assim" -->

2. Depois de clicar em **Abrir Mesmo Assim**, o macOS pode pedir a sua senha e perguntar mais uma vez se quer abrir o Oikos. Clique em **Abrir**.

Você só precisa fazer isso uma vez. Depois, o Oikos abre como qualquer outro app.

## A primeira vez que o Oikos abre

- Aparece uma tela de carregamento rápida enquanto o Oikos prepara o banco de dados local. Na primeira vez demora um pouco mais; depois fica mais rápido.
- Em seguida você vê a página de boas-vindas. Como pai ou mãe, escolha uma opção:
  - **Crie sua família** para começar do zero e se cadastrar como pai ou mãe.
  - **Restaurar de um backup** se você já tem um arquivo de backup `.oikos`.

## Seus dados e backups

- Tudo fica guardado somente neste computador. Se o computador for perdido ou o disco der problema, os dados se perdem, a não ser que você tenha um backup.
- Para salvar um backup, abra **Configurações → Backup** e clique em **Salvar backup**. O Oikos pergunta onde guardar o arquivo. Guarde uma cópia em um lugar seguro, como um pen drive ou uma pasta na nuvem em que você confie.
- Para mudar de computador, ou depois de reinstalar, instale o Oikos, escolha **Restaurar de um backup** na página de boas-vindas e selecione o seu arquivo `.oikos`. Em seguida o Oikos pede para você definir uma senha.

## Deu algum problema?

Me mande uma mensagem ou me ligue. Se puder, conte o que apareceu na tela (uma foto ajuda muito).
