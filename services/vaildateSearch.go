package services

import (
	"regexp"
	"strings"
)

func IsPhone(userSearch string) bool {
	userSearch = strings.ReplaceAll(userSearch, " ", "")
	userSearch = strings.ReplaceAll(userSearch, "-", "")
	userSearch = strings.ReplaceAll(userSearch, "(", "")
	userSearch = strings.ReplaceAll(userSearch, ")", "")

	if !regexp.MustCompile(`^/d+$`).MatchString(userSearch) {
		return false
	}

	if userSearch[0] != '7' && userSearch[0] != '8' {
		return false
	}

	return true
}

func IsID(userSearch string) bool {
	return regexp.MustCompile(`^\d+$`).MatchString(userSearch)
}
