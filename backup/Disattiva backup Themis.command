#!/bin/bash
# Spegne il backup automatico di Themis. Le copie già fatte restano dove sono.
ETICHETTA="it.studiofussone.themis-backup"
launchctl bootout "gui/$(id -u)/$ETICHETTA" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/$ETICHETTA.plist"
echo "Backup automatico disattivato. Le copie già fatte non sono state toccate."
read -r -p "Premi Invio per chiudere" _
