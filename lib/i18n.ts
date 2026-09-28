// Add locale dictionaries here; never use food names as translation keys.
export const hr={app:'Kalora',today:'Danas',history:'Povijest',ai:'AI',profile:'Profil',breakfast:'Doručak',lunch:'Ručak',dinner:'Večera',snack:'Međuobroci',calories:'Kalorije',protein:'Proteini',carbs:'Ugljikohidrati',fat:'Masti',estimate:'Procjena',add:'Dodaj obrok',cancel:'Odustani',save:'Spremi',delete:'Obriši',undo:'Poništi',grams:'Količina (g)'};
export const dictionaries={hr};
export const t=(key:keyof typeof hr,locale:keyof typeof dictionaries='hr')=>dictionaries[locale][key];
